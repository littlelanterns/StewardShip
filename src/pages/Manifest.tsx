import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { Upload, MessageSquare, Loader, List, LayoutGrid, CheckSquare, FolderInput, X, Plus, Folder, Trash2, Search, Library, BookOpen, Sparkles } from 'lucide-react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { usePageContext } from '../hooks/usePageContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useManifest } from '../hooks/useManifest';
import { useFrameworks } from '../hooks/useFrameworks';
import { useManifestExtraction } from '../hooks/useManifestExtraction';
import { useBookDiscussions } from '../hooks/useBookDiscussions';
import type { ManifestItem, BookGenre, DiscussionType, DiscussionAudience } from '../lib/types';
import { supabase } from '../lib/supabase';
import { ManifestItemCard } from '../components/manifest/ManifestItemCard';
import { ManifestItemDetail } from '../components/manifest/ManifestItemDetail';
import { useTagUsage } from '../hooks/useTagUsage';
import { UploadFlow } from '../components/manifest/UploadFlow';
import { BookDiscussionModal } from '../components/manifest/BookDiscussionModal';
import { BookSelector } from '../components/manifest/BookSelector';
import { AdminBookManager } from '../components/manifest/AdminBookManager';
import { CollectionSidebar } from '../components/manifest/CollectionSidebar';
import { CollectionModal } from '../components/manifest/CollectionModal';
import { ExtractionsView } from '../components/manifest/ExtractionsView';
import { SemanticSearch, INITIAL_SEARCH_STATE } from '../components/manifest/SemanticSearch';
import type { SearchState } from '../components/manifest/SemanticSearch';
import { SearchFab } from '../components/manifest/SearchFab';
import { ManifestSidebar } from '../components/manifest/ManifestSidebar';
import { useManifestCollections } from '../hooks/useManifestCollections';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { Button, EmptyState, LoadingSpinner, FeatureGuide, TagPills } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Manifest.css';

type ViewMode = 'list' | 'detail' | 'upload';
type LibraryLayout = 'compact' | 'grid';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'has_extractions' | 'recently_viewed' | 'most_annotated' | 'failed_first';
type GroupMode = 'by_folder' | 'all_books';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Recently Added' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'recently_viewed', label: 'Recently Viewed' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'has_extractions', label: 'Has Extractions' },
  { value: 'most_annotated', label: 'Most Annotated' },
  { value: 'failed_first', label: 'Failed First' },
];

// --- sessionStorage helpers (safe for incognito / storage-disabled browsers) ---
function ssGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* ignored */ }
}
function ssRemove(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* ignored */ }
}

const TAB_LABELS: Record<string, string> = {
  summary: 'Summary',
  frameworks: 'Frameworks',
  action_steps: 'Action Steps',
  mast_content: 'Declarations',
  questions: 'Questions',
};
const VIEW_MODE_LABELS: Record<string, string> = {
  tabs: 'Tabs',
  chapters: 'Chapters',
  notes: 'Notes',
};

export default function Manifest() {
  usePageContext({ page: 'manifest' });

  // Swap PWA manifest so "Add to Home Screen" from /manifest creates a
  // separate "My Library" icon with the black-S logo
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (link) {
      link.href = '/manifest-library.json';
      return () => { link.href = '/manifest.json'; };
    }
  }, []);
  const { user } = useAuthContext();
  const {
    items,
    loading,
    fetchItems,
    uploadFile,
    updateItem,
    reprocessItem,
    archiveItem,
    deleteItem,
    pollProcessingStatus,
    getUniqueFolders,
    fetchItemDetail,
    checkDuplicate,
    enrichItem,
    autoIntakeItem,
    fetchParts,
    processChildParts,
    reprocessSinglePart,
    getQueuePosition,
  } = useManifest();

  const {
    saveFramework,
    getFrameworkForItem,
    fetchFrameworks,
    tagFramework,
  } = useFrameworks();

  const extraction = useManifestExtraction();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [libraryLayout, setLibraryLayout] = useState<LibraryLayout>('compact');
  const [groupMode, setGroupMode] = useState<GroupMode>('by_folder');
  const [selectedItem, setSelectedItem] = useState<ManifestItem | null>(null);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [titleSearch, setTitleSearch] = useState('');
  const [continueDismissed, setContinueDismissed] = useState(false);
  const [showSemanticSearch, setShowSemanticSearch] = useState(false);
  const searchStateRef = useRef<SearchState>({ ...INITIAL_SEARCH_STATE });
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [initialExtractionTab, setInitialExtractionTab] = useState<string | null>(null);
  const [refreshingAllKeyPoints, setRefreshingAllKeyPoints] = useState(false);
  const [refreshAllProgress, setRefreshAllProgress] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return sessionStorage.getItem('manifest-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { sessionStorage.setItem('manifest-sidebar-collapsed', String(next)); } catch { /* */ }
      return next;
    });
  }, []);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // Parent/child parts state for split books
  const [parentItem, setParentItem] = useState<ManifestItem | null>(null);
  const [childParts, setChildParts] = useState<ManifestItem[]>([]);

  // Discussion state
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [discussionModal, setDiscussionModal] = useState<{
    bookTitles: string[];
    manifestItemIds: string[];
    discussionType: DiscussionType;
    audience?: DiscussionAudience;
    existingDiscussionId?: string;
  } | null>(null);
  const {
    discussions,
    fetchDiscussions,
    deleteDiscussion,
  } = useBookDiscussions();

  const [generatingTags, setGeneratingTags] = useState(false);

  // Collections
  const {
    collections,
    collectionItemsMap,
    fetchCollections,
    createCollection,
    updateCollection,
    archiveCollection,
    addToCollection,
    removeFromCollection,
    getItemIdsForCollection,
    reorderCollectionItems,
    pushCollection,
  } = useManifestCollections();
  const [collectionSidebarOpen, setCollectionSidebarOpen] = useState(false);
  const [pushCollectionLoading, setPushCollectionLoading] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  // Collection extractions view state
  const [collectionExtractionsId, setCollectionExtractionsId] = useState<string | null>(null);
  const [collectionModalId, setCollectionModalId] = useState<string | null>(null);

  // DnD sensors for collections
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Select mode (for folder assignment)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingToFolder, setMovingToFolder] = useState(false);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleMoveToFolder = useCallback(async (folder: string) => {
    setMovingToFolder(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => updateItem(id, { folder_group: folder })),
      );
      setSelectedIds(new Set());
      setSelectMode(false);
      setShowFolderPicker(false);
      setNewFolderName('');
      fetchItems();
    } finally {
      setMovingToFolder(false);
    }
  }, [selectedIds, updateItem, fetchItems]);

  const existingFolders = useMemo(() => getUniqueFolders(), [getUniqueFolders]);

  // Filters & sort
  const [activeManifestTags, setActiveManifestTags] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const { counts: tagUsageCounts, recordTagClick } = useTagUsage();

  // Persist a single preference to user_settings (fire-and-forget)
  const persistPreference = useCallback((key: string, value: string) => {
    if (!user) return;
    supabase.from('user_settings').update({ [key]: value }).eq('user_id', user.id).then();
  }, [user]);

  // Load persisted preferences on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_settings')
      .select('manifest_group_mode, manifest_sort, manifest_layout')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.manifest_group_mode) setGroupMode(data.manifest_group_mode as GroupMode);
        if (data.manifest_sort) setSortOption(data.manifest_sort as SortOption);
        if (data.manifest_layout) setLibraryLayout(data.manifest_layout as LibraryLayout);
      });
  }, [user]);

  const handleSetGroupMode = useCallback((mode: GroupMode) => {
    setGroupMode(mode);
    persistPreference('manifest_group_mode', mode);
  }, [persistPreference]);

  const handleSetSortOption = useCallback((opt: SortOption) => {
    setSortOption(opt);
    persistPreference('manifest_sort', opt);
    // Time-based sorts should show flat list so chronological order is visible
    if ((opt === 'newest' || opt === 'recently_viewed' || opt === 'failed_first') && groupMode === 'by_folder') {
      setGroupMode('all_books');
      persistPreference('manifest_group_mode', 'all_books');
    }
  }, [persistPreference, groupMode]);

  const handleSetLibraryLayout = useCallback((layout: LibraryLayout) => {
    setLibraryLayout(layout);
    persistPreference('manifest_layout', layout);
  }, [persistPreference]);

  // Delete folder — move all books to Uncategorized
  const handleDeleteFolder = useCallback(async (folder: string) => {
    const folderItemIds = items.filter((i) => i.folder_group === folder).map((i) => i.id);
    if (folderItemIds.length === 0) return;
    await Promise.all(folderItemIds.map((id) => updateItem(id, { folder_group: 'Uncategorized' })));
    setFolderToDelete(null);
    fetchItems();
  }, [items, updateItem, fetchItems]);

  // Only fetch items on mount — show book list immediately
  // Frameworks, discussions, collections are fetched lazily when needed
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Lazy fetch: frameworks + discussions only when opening a book detail
  const secondaryFetchedRef = useRef(false);
  const ensureSecondaryData = useCallback(() => {
    if (secondaryFetchedRef.current) return;
    secondaryFetchedRef.current = true;
    fetchFrameworks();
    fetchDiscussions();
    fetchCollections();
  }, [fetchFrameworks, fetchDiscussions, fetchCollections]);

  // Refresh key points for all extracted books
  const handleRefreshAllKeyPoints = useCallback(async () => {
    const extractedBooks = items.filter((i) => i.extraction_status === 'completed');
    if (extractedBooks.length === 0) return;
    setRefreshingAllKeyPoints(true);
    let done = 0;
    for (const book of extractedBooks) {
      setRefreshAllProgress(`${done + 1} of ${extractedBooks.length}: ${book.title}`);
      try {
        await supabase.functions.invoke('manifest-key-points', {
          body: { manifest_item_id: book.id },
        });
      } catch (err) {
        console.error(`Key points failed for ${book.title}:`, err);
      }
      done++;
      // Brief pause to avoid rate limiting
      if (done < extractedBooks.length) await new Promise((r) => setTimeout(r, 500));
    }
    setRefreshAllProgress(`Done — ${done} books updated`);
    setRefreshingAllKeyPoints(false);
    setTimeout(() => setRefreshAllProgress(''), 4000);
  }, [items]);

  // Fetch extraction status for child parts of multi-part books
  const [partExtractionMap, setPartExtractionMap] = useState<Map<string, { extracted: number; total: number }>>(new Map());

  useEffect(() => {
    if (!user) return;
    const parents = items.filter((i) => (i.part_count ?? 0) > 0);
    if (parents.length === 0) {
      setPartExtractionMap(new Map());
      return;
    }
    const parentIds = parents.map((p) => p.id);
    supabase
      .from('manifest_items')
      .select('id, parent_manifest_item_id, extraction_status')
      .in('parent_manifest_item_id', parentIds)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, { extracted: number; total: number }>();
        for (const part of data) {
          const pid = part.parent_manifest_item_id as string;
          if (!map.has(pid)) map.set(pid, { extracted: 0, total: 0 });
          const entry = map.get(pid)!;
          entry.total++;
          if (part.extraction_status === 'completed' || part.extraction_status === 'failed') {
            entry.extracted++;
          }
        }
        setPartExtractionMap(map);
      });
  }, [user, items]);

  // Poll for processing items — use ref to avoid feedback loop
  // (pollProcessingStatus calls setItems → items change → effect re-fires)
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const processingItems = itemsRef.current.filter(
      (i) => i.processing_status === 'pending' || i.processing_status === 'processing',
    );
    processingItems.forEach((item) => {
      pollProcessingStatus(item.id);
    });
    // Only run on mount and when pollProcessingStatus identity changes (user change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollProcessingStatus]);

  const handleSelectItem = useCallback(async (item: ManifestItem) => {
    ensureSecondaryData();
    const detail = await fetchItemDetail(item.id);
    const resolvedItem = detail || item;
    setSelectedItem(resolvedItem);
    setViewMode('detail');
    ssSet('manifest-selected-item', resolvedItem.id);
    ssSet('manifest-selected-title', resolvedItem.title);
    // Update last_viewed_at for "Recently Viewed" sort (fire-and-forget)
    supabase.from('manifest_items').update({ last_viewed_at: new Date().toISOString() }).eq('id', resolvedItem.id).then();
    // Fetch child parts if this is a parent with parts
    if ((resolvedItem.part_count ?? 0) > 0) {
      const parts = await fetchParts(resolvedItem.id);
      setChildParts(parts);
      setParentItem(null); // This IS the parent
    } else if (resolvedItem.parent_manifest_item_id) {
      // This is a part — keep parent reference
      // parentItem should already be set from onSelectPart
    } else {
      setChildParts([]);
      setParentItem(null);
    }
    // Always re-fetch extraction data when opening detail view
    // so edits made on Extractions/Favorites pages are visible
    if (detail?.processing_status === 'completed' || item.processing_status === 'completed') {
      extraction.fetchSummaries(item.id);
      extraction.fetchDeclarations(item.id);
      extraction.fetchActionSteps(item.id);
      extraction.fetchQuestions(item.id);
    }
  }, [fetchItemDetail, extraction, fetchParts]);

  // Source table → extraction tab mapping
  const SOURCE_TABLE_TO_TAB: Record<string, string> = {
    manifest_summaries: 'summary',
    ai_framework_principles: 'frameworks',
    manifest_action_steps: 'action_steps',
    manifest_declarations: 'mast_content',
    manifest_questions: 'questions',
  };

  const handleNavigateToResult = useCallback(async (manifestItemId: string, sourceTable: string, recordId: string) => {
    // Map source table to tab
    const tab = SOURCE_TABLE_TO_TAB[sourceTable] || 'summary';
    setInitialExtractionTab(tab);
    setHighlightItemId(recordId);
    // Close search modal
    setShowSemanticSearch(false);

    // Find the item in loaded items or fetch it
    const existing = items.find((i) => i.id === manifestItemId);
    if (existing) {
      await handleSelectItem(existing);
    } else {
      // Item not in current list — fetch directly
      const detail = await fetchItemDetail(manifestItemId);
      if (detail) {
        setSelectedItem(detail);
        setViewMode('detail');
        ssSet('manifest-selected-item', detail.id);
        ssSet('manifest-selected-title', detail.title);
        if (detail.processing_status === 'completed') {
          extraction.fetchSummaries(detail.id);
          extraction.fetchDeclarations(detail.id);
          extraction.fetchActionSteps(detail.id);
          extraction.fetchQuestions(detail.id);
        }
      }
    }
  }, [items, handleSelectItem, fetchItemDetail, extraction]);

  const handleHighlightComplete = useCallback(() => {
    setHighlightItemId(null);
    setInitialExtractionTab(null);
  }, []);

  // Pick up cross-page navigation from Extractions/Favorites pages
  const crossNavHandledRef = useRef(false);
  useEffect(() => {
    if (crossNavHandledRef.current || !items.length) return;
    try {
      const raw = sessionStorage.getItem('manifest-search-navigate');
      if (raw) {
        sessionStorage.removeItem('manifest-search-navigate');
        crossNavHandledRef.current = true;
        const { manifestItemId, tab, recordId } = JSON.parse(raw);
        setInitialExtractionTab(tab);
        setHighlightItemId(recordId);
        const existing = items.find((i) => i.id === manifestItemId);
        if (existing) {
          handleSelectItem(existing);
        } else {
          fetchItemDetail(manifestItemId).then((detail) => {
            if (detail) {
              setSelectedItem(detail);
              setViewMode('detail');
              ssSet('manifest-selected-item', detail.id);
              ssSet('manifest-selected-title', detail.title);
              if (detail.processing_status === 'completed') {
                extraction.fetchSummaries(detail.id);
                extraction.fetchDeclarations(detail.id);
                extraction.fetchActionSteps(detail.id);
                extraction.fetchQuestions(detail.id);
              }
            }
          });
        }
      }
    } catch { /* */ }
  }, [items, handleSelectItem, fetchItemDetail, extraction]);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setParentItem(null);
    setChildParts([]);
    setViewMode('list');
    setHighlightItemId(null);
    setInitialExtractionTab(null);
    ssRemove('manifest-selected-item');
    ssRemove('manifest-selected-title');
    fetchItems();
  }, [fetchItems]);

  const handleSelectPart = useCallback(async (part: ManifestItem) => {
    // Save current item as parent before navigating to the part
    if (selectedItem) {
      setParentItem(selectedItem);
    }
    const detail = await fetchItemDetail(part.id);
    setSelectedItem(detail || part);
    // Fetch extractions for the part
    if (detail?.processing_status === 'completed' || part.processing_status === 'completed') {
      extraction.fetchSummaries(part.id);
      extraction.fetchDeclarations(part.id);
      extraction.fetchActionSteps(part.id);
      extraction.fetchQuestions(part.id);
    }
  }, [selectedItem, fetchItemDetail, extraction]);

  const handleBackToParent = useCallback(async () => {
    if (!parentItem) return;
    const detail = await fetchItemDetail(parentItem.id);
    const resolvedParent = detail || parentItem;
    setSelectedItem(resolvedParent);
    setParentItem(null);
    // Re-fetch parts
    if ((resolvedParent.part_count ?? 0) > 0) {
      const parts = await fetchParts(resolvedParent.id);
      setChildParts(parts);
    }
  }, [parentItem, fetchItemDetail, fetchParts]);


  const handleUpload = useCallback(async (file: File) => {
    const item = await uploadFile(file);
    if (item) {
      pollProcessingStatus(item.id, true);
    }
    return item;
  }, [uploadFile, pollProcessingStatus]);

  const handleDiscussBooks = useCallback(() => {
    ensureSecondaryData();
    setFabExpanded(false);
    setShowBookSelector(true);
  }, [ensureSecondaryData]);

  const handleBookSelectorStart = useCallback((selectedIds: string[], audience: DiscussionAudience) => {
    const titles = selectedIds.map((id) => {
      const item = items.find((i) => i.id === id);
      return item?.title || 'Unknown';
    });
    setShowBookSelector(false);
    setDiscussionModal({
      bookTitles: titles,
      manifestItemIds: selectedIds,
      discussionType: 'discuss',
      audience,
    });
  }, [items]);

  const handleOpenDiscussionFromDetail = useCallback((type: DiscussionType) => {
    if (!selectedItem) return;
    setDiscussionModal({
      bookTitles: [selectedItem.title],
      manifestItemIds: [selectedItem.id],
      discussionType: type,
    });
  }, [selectedItem]);

  const handleGenerateTags = useCallback(async () => {
    if (!selectedItem) return;
    const framework = getFrameworkForItem(selectedItem.id);
    if (!framework?.principles?.length) return;
    setGeneratingTags(true);
    try {
      await tagFramework(framework.id, framework.name, framework.principles.map((p) => p.text));
    } finally {
      setGeneratingTags(false);
    }
  }, [selectedItem, getFrameworkForItem, tagFramework]);

  const handleContinueDiscussion = useCallback(async (discussionId: string) => {
    const disc = discussions.find((d) => d.id === discussionId);
    if (!disc) return;
    const titles = disc.manifest_item_ids.map((id) => {
      const item = items.find((i) => i.id === id);
      return item?.title || 'Unknown';
    });
    setDiscussionModal({
      bookTitles: titles,
      manifestItemIds: disc.manifest_item_ids,
      discussionType: disc.discussion_type,
      audience: disc.audience,
      existingDiscussionId: disc.id,
    });
  }, [discussions, items]);

  const handleDiscussionClosed = useCallback(() => {
    setDiscussionModal(null);
    fetchDiscussions();
  }, [fetchDiscussions]);

  // --- Extraction handlers (wired to useManifestExtraction) ---

  // Refresh selected item + items list after extraction to sync extraction_status
  const refreshAfterExtraction = useCallback(async (itemId: string) => {
    const detail = await fetchItemDetail(itemId);
    if (detail) setSelectedItem(detail);
    fetchItems();
  }, [fetchItemDetail, fetchItems]);

  const handleExtractAll = useCallback(async (genres: BookGenre[]): Promise<boolean> => {
    if (!selectedItem) return false;
    // If framework already exists, append to preserve existing principles
    const existingFw = getFrameworkForItem(selectedItem.id);
    const success = await extraction.extractAll(selectedItem.id, genres, async (result) => {
      // Save framework result through useFrameworks
      if (result && result.principles?.length > 0) {
        const frameworkName = result.framework_name || selectedItem.title || 'Extracted Framework';
        await saveFramework(
          selectedItem.id,
          frameworkName,
          result.principles.map((p: { text: string; sort_order: number }) => ({
            text: p.text,
            sort_order: p.sort_order,
          })),
          true,
          !!existingFw,
        );
        fetchFrameworks();
      }
    });
    await refreshAfterExtraction(selectedItem.id);
    return success;
  }, [selectedItem, extraction, saveFramework, getFrameworkForItem, fetchFrameworks, refreshAfterExtraction]);

  const handleDiscoverSections = useCallback(async () => {
    if (!selectedItem) return [];
    return extraction.discoverSections(selectedItem.id);
  }, [selectedItem, extraction]);

  const handleExtractAllSections = useCallback(async (genres: BookGenre[], sectionIndices: number[]): Promise<boolean> => {
    if (!selectedItem) return false;
    let principleOffset = 0;

    // Check if framework already exists — if so, always append to preserve existing principles.
    // Use mutable flag: after first section creates the framework, all subsequent sections must append.
    let shouldAppend = !!getFrameworkForItem(selectedItem.id);

    const success = await extraction.extractAllSections(selectedItem.id, genres, sectionIndices, async (result, sectionTitle, _sectionIndex) => {
      // Save framework results progressively per-section so they appear in the UI immediately
      // Accept results even if framework_name is missing/empty — use book title as fallback
      if (result && result.principles?.length > 0) {
        const frameworkName = result.framework_name || selectedItem.title || 'Extracted Framework';
        console.log(`[handleExtractAllSections] Saving ${result.principles.length} principles from section "${sectionTitle}" (framework: "${frameworkName}")`);
        const principles = result.principles.map((p: { text: string; sort_order: number }, idx: number) => ({
          text: p.text,
          sort_order: principleOffset + idx,
          section_title: sectionTitle,
        }));
        principleOffset += principles.length;
        await saveFramework(selectedItem.id, frameworkName, principles, true, shouldAppend);
        shouldAppend = true; // After first save creates the framework, always append
      }
    });

    fetchFrameworks();
    await refreshAfterExtraction(selectedItem.id);
    return success;
  }, [selectedItem, extraction, saveFramework, getFrameworkForItem, fetchFrameworks, refreshAfterExtraction]);

  const handleSummaryGoDeeper = useCallback((sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.goDeeper(selectedItem.id, 'summary', selectedItem.genres || [], sectionTitle, existingItems, {
      sectionIndex: sectionIndex ?? offsets?.index,
      sectionStart: offsets?.start,
      sectionEnd: offsets?.end,
    });
  }, [selectedItem, extraction]);

  const handleSummaryReRun = useCallback((sectionTitle?: string) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.reRunTab(selectedItem.id, 'summary', selectedItem.genres || [], sectionTitle, offsets?.start, offsets?.end, offsets?.index);
  }, [selectedItem, extraction]);

  const handleDeclarationGoDeeper = useCallback((sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.goDeeper(selectedItem.id, 'mast_content', selectedItem.genres || [], sectionTitle, existingItems, {
      sectionIndex: sectionIndex ?? offsets?.index,
      sectionStart: offsets?.start,
      sectionEnd: offsets?.end,
    });
  }, [selectedItem, extraction]);

  const handleDeclarationReRun = useCallback((sectionTitle?: string) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.reRunTab(selectedItem.id, 'mast_content', selectedItem.genres || [], sectionTitle, offsets?.start, offsets?.end, offsets?.index);
  }, [selectedItem, extraction]);

  const handleActionStepGoDeeper = useCallback((sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.goDeeper(selectedItem.id, 'action_steps', selectedItem.genres || [], sectionTitle, existingItems, {
      sectionIndex: sectionIndex ?? offsets?.index,
      sectionStart: offsets?.start,
      sectionEnd: offsets?.end,
    });
  }, [selectedItem, extraction]);

  const handleActionStepReRun = useCallback((sectionTitle?: string) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.reRunTab(selectedItem.id, 'action_steps', selectedItem.genres || [], sectionTitle, offsets?.start, offsets?.end, offsets?.index);
  }, [selectedItem, extraction]);

  const handleQuestionGoDeeper = useCallback((sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.goDeeper(selectedItem.id, 'questions', selectedItem.genres || [], sectionTitle, existingItems, {
      sectionIndex: sectionIndex ?? offsets?.index,
      sectionStart: offsets?.start,
      sectionEnd: offsets?.end,
    });
  }, [selectedItem, extraction]);

  const handleQuestionReRun = useCallback((sectionTitle?: string) => {
    if (!selectedItem) return;
    const offsets = sectionTitle ? extraction.getSectionOffsets(sectionTitle) : null;
    extraction.reRunTab(selectedItem.id, 'questions', selectedItem.genres || [], sectionTitle, offsets?.start, offsets?.end, offsets?.index);
  }, [selectedItem, extraction]);

  const handleSendQuestionToPrompts = useCallback(async (questionId: string) => {
    if (!selectedItem) return;
    await extraction.sendQuestionToPrompts(questionId, selectedItem.title);
  }, [selectedItem, extraction]);

  const handleFrameworkReRun = useCallback(async () => {
    if (!selectedItem) return;
    // Soft-delete existing principles first
    const existingFw = getFrameworkForItem(selectedItem.id);
    if (existingFw) {
      // saveFramework with append=false now soft-deletes (is_deleted=true)
      await saveFramework(selectedItem.id, existingFw.name, [], true, false);
    }

    let principleOffset = 0;
    await extraction.reRunFrameworks(selectedItem.id, selectedItem.genres || [], async (result, sectionTitle, _sectionIndex) => {
      if (result && result.principles?.length > 0) {
        const frameworkName = result.framework_name || selectedItem.title || 'Extracted Framework';
        const principles = result.principles.map((p: { text: string; sort_order: number }, idx: number) => ({
          text: p.text,
          sort_order: principleOffset + idx,
          section_title: sectionTitle,
        }));
        principleOffset += principles.length;
        await saveFramework(selectedItem.id, frameworkName, principles, true, true);
      }
    });

    fetchFrameworks();
    await refreshAfterExtraction(selectedItem.id);
  }, [selectedItem, extraction, saveFramework, getFrameworkForItem, fetchFrameworks, refreshAfterExtraction]);

  // Fresh Start state
  const [showFreshStart, setShowFreshStart] = useState(false);
  const [freshStartRemoveClones, setFreshStartRemoveClones] = useState(false);
  const [freshStartRunning, setFreshStartRunning] = useState(false);

  const handleFreshStart = useCallback(async () => {
    setFreshStartRunning(true);
    try {
      await extraction.resetAllExtractions({ removeClones: freshStartRemoveClones });
      fetchFrameworks();
      fetchItems();
      setShowFreshStart(false);
      setFreshStartRemoveClones(false);
    } finally {
      setFreshStartRunning(false);
    }
  }, [extraction, freshStartRemoveClones, fetchFrameworks, fetchItems]);

  // Filtering
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeManifestTags.size > 0) {
      result = result.filter((item) =>
        Array.from(activeManifestTags).some((tag) => item.tags.includes(tag))
      );
    }
    if (titleSearch.trim()) {
      const q = titleSearch.trim().toLowerCase();
      result = result.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        (item.author && item.author.toLowerCase().includes(q)) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (item.ai_summary && item.ai_summary.toLowerCase().includes(q)) ||
        (item.genres || []).some((g) => g.replace(/_/g, ' ').toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, activeManifestTags, titleSearch]);

  const hasCompletedItems = items.some((i) => i.processing_status === 'completed');
  const hasExtractedItems = items.some((i) =>
    i.extraction_status === 'completed' || i.extraction_status === 'failed' ||
    (partExtractionMap.get(i.id)?.extracted ?? 0) > 0
  );
  const processingItems = items.filter(
    (i) => i.processing_status === 'pending' || i.processing_status === 'processing',
  );
  const hasProcessingItems = processingItems.length > 0;

  // Sort items: processing always first, then by selected sort option
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aProcessing = a.processing_status === 'pending' || a.processing_status === 'processing';
      const bProcessing = b.processing_status === 'pending' || b.processing_status === 'processing';
      if (aProcessing && !bProcessing) return -1;
      if (!aProcessing && bProcessing) return 1;

      switch (sortOption) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_asc':
          return a.title.localeCompare(b.title);
        case 'name_desc':
          return b.title.localeCompare(a.title);
        case 'has_extractions': {
          const aHasExtraction = (a.extraction_status === 'completed' || a.extraction_status === 'failed' || (partExtractionMap.get(a.id)?.extracted ?? 0) > 0) ? 0 : 1;
          const bHasExtraction = (b.extraction_status === 'completed' || b.extraction_status === 'failed' || (partExtractionMap.get(b.id)?.extracted ?? 0) > 0) ? 0 : 1;
          if (aHasExtraction !== bHasExtraction) return aHasExtraction - bHasExtraction;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case 'recently_viewed': {
          const aViewed = a.last_viewed_at ? new Date(a.last_viewed_at).getTime() : 0;
          const bViewed = b.last_viewed_at ? new Date(b.last_viewed_at).getTime() : 0;
          if (aViewed !== bViewed) return bViewed - aViewed;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case 'most_annotated': {
          // Approximate engagement: books with extractions and hearts rank higher
          const aScore = (a.extraction_status === 'completed' ? 1 : 0);
          const bScore = (b.extraction_status === 'completed' ? 1 : 0);
          if (aScore !== bScore) return bScore - aScore;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case 'failed_first': {
          const aFailed = (a.processing_status === 'failed' || a.extraction_status === 'failed') ? 0 : 1;
          const bFailed = (b.processing_status === 'failed' || b.extraction_status === 'failed') ? 0 : 1;
          if (aFailed !== bFailed) return aFailed - bFailed;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [filteredItems, sortOption, partExtractionMap]);

  // Group by folder (uses sortedItems so items within folders respect sort order)
  const folderGroups = useMemo(() => {
    const groups: Record<string, ManifestItem[]> = {};
    for (const item of sortedItems) {
      const folder = item.folder_group || 'Uncategorized';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedItems]);

  const tagData = useMemo((): Array<[string, number]> => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      for (const tag of item.tags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts);
  }, [items]);

  // Keep selectedItem in sync with items array
  const currentSelectedItem = useMemo(
    () => (selectedItem ? items.find((i) => i.id === selectedItem.id) || selectedItem : null),
    [items, selectedItem],
  );

  // Get framework principles for current item
  const currentFramework = currentSelectedItem ? getFrameworkForItem(currentSelectedItem.id) : undefined;
  const currentPrinciples: import('../lib/types').AIFrameworkPrinciple[] = currentFramework?.principles || [];

  // Collection drag-and-drop handlers
  const wasDraggingRef = useRef(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
    wasDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (over) {
      addToCollection(over.id as string, [active.id as string]);
    }
    // Clear after a tick so the subsequent click event is suppressed
    setTimeout(() => { wasDraggingRef.current = false; }, 0);
  }, [addToCollection]);

  const handleDragCancel = useCallback(() => {
    setDragActiveId(null);
    setTimeout(() => { wasDraggingRef.current = false; }, 0);
  }, []);

  const draggedItem = dragActiveId ? items.find((i) => i.id === dragActiveId) : null;

  // Drag-safe click handler: suppress onClick that fires after a drag ends
  const handleCardClick = useCallback((item: ManifestItem) => {
    if (wasDraggingRef.current) return;
    if (selectMode) {
      toggleSelectItem(item.id);
    } else {
      handleSelectItem(item);
    }
  }, [selectMode, toggleSelectItem, handleSelectItem]);

  // Collection action handlers
  const handleViewCollectionExtractions = useCallback((collectionId: string) => {
    setCollectionExtractionsId(collectionId);
  }, []);

  const handleExportCollection = useCallback((collectionId: string) => {
    // Set collection extractions view then immediately trigger export
    setCollectionExtractionsId(collectionId);
  }, []);

  const handlePushCollection = useCallback(async (collectionId: string) => {
    setPushCollectionLoading(true);
    try {
      const result = await pushCollection(collectionId);
      alert(result.message);
    } finally {
      setPushCollectionLoading(false);
    }
  }, [pushCollection]);

  const handlePushAllCollections = useCallback(async () => {
    if (collections.length === 0) return;
    setPushCollectionLoading(true);
    const results: string[] = [];
    try {
      for (const col of collections) {
        const result = await pushCollection(col.id);
        results.push(`${col.name}: ${result.message}`);
      }
      alert(results.join('\n'));
    } finally {
      setPushCollectionLoading(false);
    }
  }, [collections, pushCollection]);

  const handleAddSelectedToCollection = useCallback(async (collectionId: string) => {
    await addToCollection(collectionId, [...selectedIds]);
    setSelectedIds(new Set());
    setSelectMode(false);
    setShowCollectionPicker(false);
    setNewCollectionName('');
  }, [selectedIds, addToCollection]);

  const handleCreateAndAddToCollection = useCallback(async () => {
    if (!newCollectionName.trim()) return;
    const col = await createCollection(newCollectionName.trim());
    if (col) {
      await addToCollection(col.id, [...selectedIds]);
      setSelectedIds(new Set());
      setSelectMode(false);
      setShowCollectionPicker(false);
      setNewCollectionName('');
    }
  }, [newCollectionName, createCollection, addToCollection, selectedIds]);

  // Get collection name for extractions view title
  const collectionExtractionsName = useMemo(() => {
    if (!collectionExtractionsId) return undefined;
    return collections.find((c) => c.id === collectionExtractionsId)?.name;
  }, [collectionExtractionsId, collections]);

  // Get items for the collection extractions view
  const collectionExtractionsItems = useMemo(() => {
    if (!collectionExtractionsId) return [];
    const itemIds = getItemIdsForCollection(collectionExtractionsId);
    // Map over itemIds to preserve collection sort order
    return itemIds
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is ManifestItem => i !== undefined);
  }, [collectionExtractionsId, getItemIdsForCollection, items]);

  // Collection info for ExtractionsView collection chips
  const collectionsForExtractions = useMemo(() => {
    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      itemIds: getItemIdsForCollection(c.id),
    }));
  }, [collections, getItemIdsForCollection]);

  // Semantic search is now a modal overlay (rendered at end of component)

  // Upload view
  if (viewMode === 'upload') {
    return (
      <div className="page manifest-page">
        <UploadFlow
          onUpload={handleUpload}
          onCheckDuplicate={checkDuplicate}
          onAutoIntake={autoIntakeItem}
          onArchiveItem={archiveItem}
          onReprocessItem={reprocessItem}
          onClose={handleBack}
        />
      </div>
    );
  }

  // Detail view
  if (viewMode === 'detail' && currentSelectedItem) {
    return (
      <div className="page manifest-page manifest-page--detail">
        <ManifestSidebar
          items={items}
          selectedItemId={currentSelectedItem.id}
          onSelectItem={handleSelectItem}
          onBackToLibrary={handleBack}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        <ManifestItemDetail
          item={currentSelectedItem}
          onBack={handleBack}
          onUpdateItem={updateItem}
          onReprocess={reprocessItem}
          onArchive={archiveItem}
          onDelete={deleteItem}
          onEnrichItem={enrichItem}
          // Extraction props
          summaries={extraction.summaries}
          declarations={extraction.declarations}
          actionSteps={extraction.actionSteps}
          principles={currentPrinciples}
          extracting={extraction.extracting}
          extractingTab={extraction.extractingTab}
          hasFramework={!!currentFramework}
          onExtractAll={handleExtractAll}
          onUpdateGenres={extraction.updateGenres}
          onFetchSummaries={extraction.fetchSummaries}
          onFetchDeclarations={extraction.fetchDeclarations}
          onFetchActionSteps={extraction.fetchActionSteps}
          // Summary actions
          onToggleSummaryHeart={extraction.toggleSummaryHeart}
          onDeleteSummary={extraction.deleteSummary}
          onUpdateSummaryText={extraction.updateSummaryText}
          onSummaryGoDeeper={handleSummaryGoDeeper}
          onSummaryReRun={handleSummaryReRun}
          // Framework actions
          onTogglePrincipleHeart={extraction.togglePrincipleHeart}
          onDeletePrinciple={extraction.deletePrinciple}
          onFrameworkReRun={handleFrameworkReRun}
          // Declaration actions
          onToggleDeclarationHeart={extraction.toggleDeclarationHeart}
          onDeleteDeclaration={extraction.deleteDeclaration}
          onUpdateDeclaration={extraction.updateDeclaration}
          onSendDeclarationToMast={extraction.sendDeclarationToMast}
          onDeclarationGoDeeper={handleDeclarationGoDeeper}
          onDeclarationReRun={handleDeclarationReRun}
          // Action Step actions
          onToggleActionStepHeart={extraction.toggleActionStepHeart}
          onDeleteActionStep={extraction.deleteActionStep}
          onUpdateActionStepText={extraction.updateActionStepText}
          onSendActionStepToCompass={extraction.sendActionStepToCompass}
          onActionStepGoDeeper={handleActionStepGoDeeper}
          onActionStepReRun={handleActionStepReRun}
          // Question actions
          questions={extraction.questions}
          onFetchQuestions={extraction.fetchQuestions}
          onToggleQuestionHeart={extraction.toggleQuestionHeart}
          onDeleteQuestion={extraction.deleteQuestion}
          onUpdateQuestionText={extraction.updateQuestionText}
          onUpdateQuestionNote={extraction.updateQuestionNote}
          onSendQuestionToPrompts={handleSendQuestionToPrompts}
          onQuestionGoDeeper={handleQuestionGoDeeper}
          onQuestionReRun={handleQuestionReRun}
          // Notes
          onUpdateSummaryNote={extraction.updateSummaryNote}
          onUpdatePrincipleNote={extraction.updatePrincipleNote}
          onUpdateActionStepNote={extraction.updateActionStepNote}
          onUpdateDeclarationNote={extraction.updateDeclarationNote}
          // Section discovery props
          onDiscoverSections={handleDiscoverSections}
          onExtractAllSections={handleExtractAllSections}
          onExtractMissingTab={async (tabType, genres) => {
            if (!selectedItem) return false;
            return extraction.extractMissingTab(selectedItem.id, tabType, genres);
          }}
          sections={extraction.sections}
          selectedSectionIndices={extraction.selectedSectionIndices}
          onSetSelectedSectionIndices={extraction.setSelectedSectionIndices}
          onUpdateSectionTitle={extraction.updateSectionTitle}
          discoveringSections={extraction.discoveringSections}
          extractionProgress={extraction.extractionProgress}
          failedSections={extraction.failedSections}
          // Merge sections
          isMergeActive={extraction.isMergeActive}
          mergeStats={extraction.mergeStats}
          onToggleMerge={extraction.toggleMergeSections}
          onRetrySection={async (sectionIndex: number) => {
            if (!selectedItem) return false;
            const success = await extraction.retrySection(
              selectedItem.id,
              selectedItem.genres || [],
              sectionIndex,
              async (result, sectionTitle, _secIdx) => {
                if (result && result.principles?.length > 0) {
                  const frameworkName = result.framework_name || selectedItem.title || 'Extracted Framework';
                  const principles = result.principles.map((p: { text: string; sort_order: number }, idx: number) => ({
                    text: p.text,
                    sort_order: idx,
                    section_title: sectionTitle,
                  }));
                  // Always append — framework already exists from initial extraction
                  await saveFramework(selectedItem.id, frameworkName, principles, true, true);
                }
              },
            );
            if (success) {
              fetchFrameworks();
              await refreshAfterExtraction(selectedItem.id);
            }
            return success;
          }}
          onClearExtractions={async (itemId: string) => {
            await extraction.clearExtractions(itemId);
            fetchFrameworks();
          }}
          onResetExtractionStatus={extraction.resetExtractionStatus}
          // Discussion
          onOpenDiscussion={handleOpenDiscussionFromDetail}
          // Generate Tags
          onGenerateTags={currentFramework?.principles?.length ? handleGenerateTags : undefined}
          generatingTags={generatingTags}
          // Deep-link from search
          initialTab={initialExtractionTab}
          highlightItemId={highlightItemId}
          onHighlightComplete={handleHighlightComplete}
          // Parts (split books)
          childParts={childParts}
          parentItem={parentItem}
          onSelectPart={handleSelectPart}
          onBackToParent={handleBackToParent}
          onProcessParts={(parentId, parts) => {
            processChildParts(parentId, parts, setChildParts);
          }}
          onReprocessSinglePart={(parentId, partId, allParts) => {
            reprocessSinglePart(parentId, partId, allParts, setChildParts);
          }}
          onDeletePart={async (partId) => {
            const success = await deleteItem(partId);
            if (success && selectedItem) {
              // Refresh parts list
              const freshParts = await fetchParts(selectedItem.id);
              setChildParts(freshParts);
              // Update parent's part_count to match remaining parts
              await supabase.from('manifest_items')
                .update({ part_count: freshParts.length })
                .eq('id', selectedItem.id);
              setSelectedItem({ ...selectedItem, part_count: freshParts.length });
            }
            return success;
          }}
          // Multi-part extraction
          onDiscoverSectionsRaw={extraction.discoverSectionsRaw}
          onExtractSectionsForPart={extraction.extractSectionsForPart}
          onSaveFrameworkForPart={async (partId, frameworkName, principles) => {
            await saveFramework(partId, frameworkName, principles, true, true);
            fetchFrameworks();
          }}
        />
        {/* Discussion modal rendered outside conditional content */}
        {discussionModal && (
          <BookDiscussionModal
            bookTitles={discussionModal.bookTitles}
            manifestItemIds={discussionModal.manifestItemIds}
            discussionType={discussionModal.discussionType}
            initialAudience={discussionModal.audience}
            existingDiscussionId={discussionModal.existingDiscussionId}
            onClose={handleDiscussionClosed}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="page manifest-page">
      <div className="manifest-page__header">
        <div className="manifest-page__header-row">
          <div>
            <h1 className="manifest-page__title">The Manifest</h1>
            <p className="manifest-page__subtitle">
              Your personal knowledge base
              {items.length > 0 && <span className="manifest-page__count"> — {items.length} item{items.length !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          {items.length > 0 && (
            <div className="manifest-page__header-controls">
              <button
                type="button"
                className={`manifest-page__select-btn${selectMode ? ' manifest-page__select-btn--active' : ''}`}
                onClick={toggleSelectMode}
                title={selectMode ? 'Cancel selection' : 'Select books to organize'}
              >
                {selectMode ? <X size={16} /> : <CheckSquare size={16} />}
                {selectMode ? 'Cancel' : 'Select'}
              </button>
              <div className="manifest-page__layout-toggle">
                <button
                  type="button"
                  className={`manifest-page__layout-btn${groupMode === 'by_folder' ? ' manifest-page__layout-btn--active' : ''}`}
                  onClick={() => handleSetGroupMode('by_folder')}
                  title="Group by folder"
                >
                  <Folder size={18} />
                </button>
                <button
                  type="button"
                  className={`manifest-page__layout-btn${groupMode === 'all_books' ? ' manifest-page__layout-btn--active' : ''}`}
                  onClick={() => handleSetGroupMode('all_books')}
                  title="All books"
                >
                  <List size={18} />
                </button>
              </div>
              <div className="manifest-page__layout-toggle">
                <button
                  type="button"
                  className={`manifest-page__layout-btn${libraryLayout === 'compact' ? ' manifest-page__layout-btn--active' : ''}`}
                  onClick={() => handleSetLibraryLayout('compact')}
                  title="Compact list"
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  className={`manifest-page__layout-btn${libraryLayout === 'grid' ? ' manifest-page__layout-btn--active' : ''}`}
                  onClick={() => handleSetLibraryLayout('grid')}
                  title="Card grid"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
              <button
                type="button"
                className={`manifest-page__select-btn${collectionSidebarOpen ? ' manifest-page__select-btn--active' : ''}`}
                onClick={() => setCollectionSidebarOpen((v) => !v)}
                title={collectionSidebarOpen ? 'Close collections' : 'Collections'}
              >
                <Library size={16} />
                Collections
              </button>
            </div>
          )}
        </div>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.manifest} />

      {/* Continue where you left off banner */}
      {!loading && !continueDismissed && (() => {
        const continueId = ssGet('manifest-selected-item');
        const continueTitle = ssGet('manifest-selected-title');
        const continueTab = ssGet('manifest-active-tab');
        const continueView = ssGet('manifest-extraction-view');
        if (!continueId || !continueTitle) return null;
        const continueItem = items.find((i) => i.id === continueId);
        if (!continueItem) return null;
        return (
          <div className="manifest-page__continue-banner" role="button" tabIndex={0}
            onClick={() => handleSelectItem(continueItem)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSelectItem(continueItem); }}
          >
            <BookOpen size={18} className="manifest-page__continue-icon" />
            <div className="manifest-page__continue-text">
              <span className="manifest-page__continue-label">Continue reading</span>
              <span className="manifest-page__continue-title">{continueTitle}</span>
              {(continueTab || continueView) && (
                <span className="manifest-page__continue-meta">
                  {continueTab && TAB_LABELS[continueTab] ? TAB_LABELS[continueTab] : ''}
                  {continueTab && continueView ? ' · ' : ''}
                  {continueView && VIEW_MODE_LABELS[continueView] ? VIEW_MODE_LABELS[continueView] : ''}
                </span>
              )}
            </div>
            <button
              type="button"
              className="manifest-page__continue-dismiss"
              title="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                setContinueDismissed(true);
                ssRemove('manifest-selected-item');
                ssRemove('manifest-selected-title');
                ssRemove('manifest-active-tab');
                ssRemove('manifest-extraction-view');
                ssRemove('manifest-filter-mode');
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })()}

      {/* Action buttons */}
      {items.length > 0 && (
        <div className="manifest-page__actions">
          <button
            type="button"
            className="manifest-page__action-btn manifest-page__action-btn--primary"
            onClick={() => setViewMode('upload')}
          >
            <Upload size={16} />
            Upload
          </button>
          {hasCompletedItems && (
            <button
              type="button"
              className="manifest-page__action-btn"
              onClick={handleDiscussBooks}
            >
              <MessageSquare size={16} />
              Discuss Books
            </button>
          )}
          {hasCompletedItems && (
            <button
              type="button"
              className="manifest-page__action-btn"
              onClick={() => setShowSemanticSearch(true)}
            >
              <Search size={16} />
              Search Library
            </button>
          )}
          {hasCompletedItems && (
            <button
              type="button"
              className="manifest-page__action-btn"
              onClick={handleRefreshAllKeyPoints}
              disabled={refreshingAllKeyPoints}
            >
              {refreshingAllKeyPoints ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
              {refreshingAllKeyPoints ? 'Refreshing...' : 'Refresh All Key Points'}
            </button>
          )}
        </div>
      )}
      {refreshAllProgress && (
        <div className="manifest-page__refresh-progress">{refreshAllProgress}</div>
      )}

      {/* Fresh Start confirmation */}
      {showFreshStart && (
        <div className="manifest-page__fresh-start">
          <div className="manifest-page__fresh-start-card">
            <h3 className="manifest-page__fresh-start-title">Fresh Start</h3>
            <p className="manifest-page__fresh-start-desc">
              This will permanently delete all extracted content (summaries, frameworks, action steps, and declarations) for every book. You can re-extract after.
            </p>
            <label className="manifest-page__fresh-start-option">
              <input
                type="checkbox"
                checked={freshStartRemoveClones}
                onChange={(e) => setFreshStartRemoveClones(e.target.checked)}
              />
              Also remove cloned books (books shared by another user)
            </label>
            <div className="manifest-page__fresh-start-actions">
              <Button variant="secondary" onClick={() => { setShowFreshStart(false); setFreshStartRemoveClones(false); }} disabled={freshStartRunning}>
                Cancel
              </Button>
              <Button onClick={handleFreshStart} disabled={freshStartRunning}>
                {freshStartRunning ? 'Clearing...' : 'Clear All Extractions'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Book Manager */}
      {user?.email === 'tenisewertman@gmail.com' && (
        <AdminBookManager onBooksChanged={fetchItems} />
      )}

      {/* Processing indicator */}
      {hasProcessingItems && (
        <div className="manifest-page__processing">
          <Loader size={14} className="manifest-page__processing-spin" />
          <span>Processing {processingItems.length} item{processingItems.length !== 1 ? 's' : ''}...</span>
        </div>
      )}

      {/* Filter bar + sort */}
      {items.length > 0 && (
        <>
          <TagPills
            tags={tagData}
            activeTags={activeManifestTags}
            onToggle={(tag) => {
              recordTagClick(tag);
              setActiveManifestTags((prev) => {
                const next = new Set(prev);
                next.has(tag) ? next.delete(tag) : next.add(tag);
                return next;
              });
            }}
            onClear={() => setActiveManifestTags(new Set())}
            usageCounts={tagUsageCounts}
            collapsible
            label="Filter by tag"
          />
          <div className="manifest-page__search-bar">
            <Search size={14} className="manifest-page__search-icon" />
            <input
              type="text"
              className="manifest-page__search-input"
              placeholder="Search by title, author, or topic..."
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
            />
            {titleSearch && (
              <button
                type="button"
                className="manifest-page__search-clear"
                onClick={() => setTitleSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="manifest-page__sort-bar">
            <span className="manifest-page__sort-label">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`manifest-page__sort-btn${sortOption === opt.value ? ' manifest-page__sort-btn--active' : ''}`}
                onClick={() => handleSetSortOption(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Folder delete confirmation */}
      {folderToDelete && (
        <div className="manifest-page__folder-delete-confirm">
          <p className="manifest-page__folder-delete-text">
            Remove folder &ldquo;{folderToDelete}&rdquo;? Books will move to Uncategorized.
          </p>
          <div className="manifest-page__folder-delete-actions">
            <Button variant="secondary" onClick={() => setFolderToDelete(null)}>Cancel</Button>
            <Button onClick={() => handleDeleteFolder(folderToDelete)}>Remove Folder</Button>
          </div>
        </div>
      )}

      {/* Collection Extractions View */}
      {collectionExtractionsId && collectionExtractionsItems.length > 0 ? (
        <ExtractionsView
          items={collectionExtractionsItems}
          onBack={() => setCollectionExtractionsId(null)}
          collectionName={collectionExtractionsName}
          collections={collectionsForExtractions}
          onSelectCollection={handleViewCollectionExtractions}
          onDiscussBooks={(bookIds) => {
            ensureSecondaryData();
            const titles = bookIds.map((id) => items.find((i) => i.id === id)?.title || 'Unknown');
            setDiscussionModal({ bookTitles: titles, manifestItemIds: bookIds, discussionType: 'discuss' });
          }}
        />
      ) : (
      /* Content — wrapped in DndContext when sidebar is open */
      <DndContext
        sensors={collectionSidebarOpen ? dndSensors : undefined}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={collectionSidebarOpen ? 'manifest-page__with-sidebar' : undefined}>
          <div className={collectionSidebarOpen ? 'manifest-page__library-content' : undefined}>
            {(
              loading && items.length === 0 ? (
                <LoadingSpinner />
              ) : items.length === 0 ? (
                <EmptyState
                  heading="Your library is empty"
                  message="Upload books, articles, notes, and transcripts. The AI draws from your library to give you advice grounded in the wisdom you trust."
                />
              ) : filteredItems.length === 0 ? (
                <div>
                  <EmptyState
                    heading="No matching items"
                    message="Try adjusting your filters to see more items."
                  />
                  {titleSearch.trim() && (
                    <button
                      type="button"
                      className="manifest-page__deep-search-hint"
                      onClick={() => setShowSemanticSearch(true)}
                    >
                      Search inside all books for "{titleSearch.trim()}"
                    </button>
                  )}
                </div>
              ) : groupMode === 'all_books' || folderGroups.length === 1 ? (
                <div className={libraryLayout === 'compact' ? 'manifest-page__compact-list' : 'manifest-page__item-list'}>
                  {sortedItems.map((item) => (
                    <ManifestItemCard
                      key={item.id}
                      item={item}
                      onClick={handleCardClick}
                      compact={libraryLayout === 'compact'}
                      selectable={selectMode}
                      selected={selectedIds.has(item.id)}
                      queuePosition={item.processing_status === 'pending' ? getQueuePosition(item.id) : null}
                      partExtraction={partExtractionMap.get(item.id) || null}
                      draggable={collectionSidebarOpen && !selectMode}
                    />
                  ))}
                </div>
              ) : (
                folderGroups.map(([folder, folderItems]) => (
                  <CollapsibleGroup
                    key={folder}
                    label={folder}
                    count={folderItems.length}
                    defaultExpanded
                    headerAction={folder !== 'Uncategorized' ? (
                      <button
                        type="button"
                        className="manifest-page__folder-delete-btn"
                        onClick={() => setFolderToDelete(folder)}
                        title={`Remove folder "${folder}"`}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : undefined}
                  >
                    <div className={libraryLayout === 'compact' ? 'manifest-page__compact-list' : 'manifest-page__item-list'}>
                      {folderItems.map((item) => (
                        <ManifestItemCard
                          key={item.id}
                          item={item}
                          onClick={handleCardClick}
                          compact={libraryLayout === 'compact'}
                          selectable={selectMode}
                          selected={selectedIds.has(item.id)}
                          queuePosition={item.processing_status === 'pending' ? getQueuePosition(item.id) : null}
                          partExtraction={partExtractionMap.get(item.id) || null}
                          draggable={collectionSidebarOpen && !selectMode}
                        />
                      ))}
                    </div>
                  </CollapsibleGroup>
                ))
              )
            )}
          </div>

          {/* Collection Sidebar */}
          {collectionSidebarOpen && (
            <CollectionSidebar
              collections={collections}
              collectionItemsMap={collectionItemsMap}
              items={items}
              activeCollectionId={activeCollectionId}
              onSelectCollection={setActiveCollectionId}
              onCreateCollection={createCollection}
              onArchiveCollection={archiveCollection}
              onUpdateCollection={updateCollection}
              onRemoveFromCollection={removeFromCollection}
              onViewExtractions={handleViewCollectionExtractions}
              onExportCollection={handleExportCollection}
              onOpenModal={setCollectionModalId}
              onClose={() => { setCollectionSidebarOpen(false); setActiveCollectionId(null); }}
              isAdmin={user?.email === 'tenisewertman@gmail.com'}
              onPushCollection={handlePushCollection}
              onPushAllCollections={handlePushAllCollections}
              pushLoading={pushCollectionLoading}
            />
          )}
        </div>

        {/* Drag overlay ghost */}
        <DragOverlay>
          {draggedItem ? (
            <div className="manifest-page__drag-ghost">
              {draggedItem.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* Discussion Archive */}
      {discussions.length > 0 && (
        <CollapsibleGroup label="Past Discussions" count={discussions.length}>
          <div className="manifest-page__discussions">
            {discussions.map((disc) => {
              const typeLabel = disc.discussion_type === 'discuss' ? 'Discussion'
                : disc.discussion_type === 'generate_goals' ? 'Goals'
                : disc.discussion_type === 'generate_questions' ? 'Questions'
                : disc.discussion_type === 'generate_tasks' ? 'Tasks'
                : 'Tracker';
              return (
                <div key={disc.id} className="manifest-page__discussion-item">
                  <button
                    type="button"
                    className="manifest-page__discussion-btn"
                    onClick={() => handleContinueDiscussion(disc.id)}
                  >
                    <span className="manifest-page__discussion-type">{typeLabel}</span>
                    <span className="manifest-page__discussion-title">
                      {disc.title || 'Untitled discussion'}
                    </span>
                    <span className="manifest-page__discussion-date">
                      {new Date(disc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="manifest-page__discussion-delete"
                    onClick={() => deleteDiscussion(disc.id)}
                    title="Delete discussion"
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        </CollapsibleGroup>
      )}

      {/* Select mode toolbar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="manifest-page__select-toolbar">
          <span className="manifest-page__select-count">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            className="manifest-page__select-action"
            onClick={() => setShowFolderPicker(true)}
          >
            <FolderInput size={16} />
            Move to Folder
          </button>
          <button
            type="button"
            className="manifest-page__select-action"
            onClick={() => setShowCollectionPicker(true)}
          >
            <Library size={16} />
            Add to Collection
          </button>
          <button
            type="button"
            className="manifest-page__select-cancel"
            onClick={toggleSelectMode}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Folder picker modal */}
      {showFolderPicker && (
        <>
          <div className="manifest-page__folder-backdrop" onClick={() => { setShowFolderPicker(false); setNewFolderName(''); }} />
          <div className="manifest-page__folder-picker">
            <h3 className="manifest-page__folder-picker-title">Move to Folder</h3>
            <div className="manifest-page__folder-list">
              {existingFolders.filter((f) => f !== 'Uncategorized').map((folder) => (
                <button
                  key={folder}
                  type="button"
                  className="manifest-page__folder-option"
                  onClick={() => handleMoveToFolder(folder)}
                  disabled={movingToFolder}
                >
                  {folder}
                </button>
              ))}
              <button
                type="button"
                className="manifest-page__folder-option"
                onClick={() => handleMoveToFolder('Uncategorized')}
                disabled={movingToFolder}
              >
                Uncategorized
              </button>
            </div>
            <div className="manifest-page__folder-new">
              <input
                type="text"
                className="manifest-page__folder-input"
                placeholder="New folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    handleMoveToFolder(newFolderName.trim());
                  }
                }}
              />
              <button
                type="button"
                className="manifest-page__folder-create"
                onClick={() => newFolderName.trim() && handleMoveToFolder(newFolderName.trim())}
                disabled={!newFolderName.trim() || movingToFolder}
              >
                <Plus size={16} />
                Create
              </button>
            </div>
          </div>
        </>
      )}

      {/* Collection picker modal */}
      {showCollectionPicker && (
        <>
          <div className="manifest-page__folder-backdrop" onClick={() => { setShowCollectionPicker(false); setNewCollectionName(''); }} />
          <div className="manifest-page__folder-picker">
            <h3 className="manifest-page__folder-picker-title">Add to Collection</h3>
            <div className="manifest-page__folder-list">
              {collections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  className="manifest-page__folder-option"
                  onClick={() => handleAddSelectedToCollection(col.id)}
                >
                  {col.name}
                  <span className="manifest-page__collection-count">
                    {(collectionItemsMap.get(col.id) || []).length} books
                  </span>
                </button>
              ))}
              {collections.length === 0 && (
                <p style={{ padding: 'var(--spacing-sm)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  No collections yet. Create one below.
                </p>
              )}
            </div>
            <div className="manifest-page__folder-new">
              <input
                type="text"
                className="manifest-page__folder-input"
                placeholder="New collection name..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCollectionName.trim()) {
                    handleCreateAndAddToCollection();
                  }
                }}
              />
              <button
                type="button"
                className="manifest-page__folder-create"
                onClick={handleCreateAndAddToCollection}
                disabled={!newCollectionName.trim()}
              >
                <Plus size={16} />
                Create
              </button>
            </div>
          </div>
        </>
      )}

      {/* FAB */}
      <div className="manifest-page__fab-area">
        {fabExpanded && (
          <div className="manifest-page__fab-options">
            <button
              type="button"
              className="manifest-page__fab-option"
              onClick={() => { setFabExpanded(false); setViewMode('upload'); }}
            >
              Upload Files
            </button>
            {hasExtractedItems && (
              <button
                type="button"
                className="manifest-page__fab-option manifest-page__fab-option--danger"
                onClick={() => { setFabExpanded(false); setShowFreshStart(true); }}
              >
                Fresh Start
              </button>
            )}
          </div>
        )}
        <FloatingActionButton onClick={() => setFabExpanded(!fabExpanded)}>
          {fabExpanded ? 'Close' : '+'}
        </FloatingActionButton>
      </div>

      {/* Book Selector Modal */}
      {showBookSelector && (
        <BookSelector
          items={items}
          onStart={handleBookSelectorStart}
          onClose={() => setShowBookSelector(false)}
        />
      )}

      {/* Discussion Modal */}
      {discussionModal && (
        <BookDiscussionModal
          bookTitles={discussionModal.bookTitles}
          manifestItemIds={discussionModal.manifestItemIds}
          discussionType={discussionModal.discussionType}
          initialAudience={discussionModal.audience}
          existingDiscussionId={discussionModal.existingDiscussionId}
          onClose={handleDiscussionClosed}
        />
      )}

      {/* Collection Modal (full-screen reorder) */}
      {collectionModalId && (() => {
        const col = collections.find((c) => c.id === collectionModalId);
        if (!col) return null;
        return (
          <CollectionModal
            collection={col}
            collectionItems={collectionItemsMap.get(collectionModalId) || []}
            allItems={items}
            onClose={() => setCollectionModalId(null)}
            onReorder={reorderCollectionItems}
            onRemove={removeFromCollection}
            onUpdateCollection={updateCollection}
            onViewExtractions={handleViewCollectionExtractions}
            onExportCollection={handleExportCollection}
            isAdmin={user?.email === 'tenisewertman@gmail.com'}
            onPushCollection={handlePushCollection}
            pushLoading={pushCollectionLoading}
          />
        );
      })()}

      {/* Floating Search FAB — visible on all views */}
      <SearchFab onClick={() => setShowSemanticSearch(true)} />

      {/* Semantic Search Modal Overlay */}
      {showSemanticSearch && (
        <div className="manifest-page__search-modal-backdrop" onClick={() => setShowSemanticSearch(false)}>
          <div className="manifest-page__search-modal" onClick={(e) => e.stopPropagation()}>
            <SemanticSearch
              onClose={() => setShowSemanticSearch(false)}
              onNavigateToResult={handleNavigateToResult}
              persistedState={searchStateRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}
