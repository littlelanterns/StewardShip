import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, StickyNote, MessageSquare, Loader, List, LayoutGrid, Heart, Layers, Trash2 } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useManifest } from '../hooks/useManifest';
import { useFrameworks } from '../hooks/useFrameworks';
import { useManifestExtraction } from '../hooks/useManifestExtraction';
import { useBookDiscussions } from '../hooks/useBookDiscussions';
import type { ManifestItem, ManifestFileType, ManifestUsageDesignation, BookGenre, DiscussionType, DiscussionAudience } from '../lib/types';
import { ManifestItemCard } from '../components/manifest/ManifestItemCard';
import { ManifestItemDetail } from '../components/manifest/ManifestItemDetail';
import { ManifestFilterBar } from '../components/manifest/ManifestFilterBar';
import { UploadFlow } from '../components/manifest/UploadFlow';
import { TextNoteModal } from '../components/manifest/TextNoteModal';
import { BookDiscussionModal } from '../components/manifest/BookDiscussionModal';
import { BookSelector } from '../components/manifest/BookSelector';
import { HeartedItemsView } from '../components/manifest/HeartedItemsView';
import { ExtractionsView } from '../components/manifest/ExtractionsView';
import { AdminBookManager } from '../components/manifest/AdminBookManager';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { Button, EmptyState, LoadingSpinner, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Manifest.css';

type ViewMode = 'list' | 'detail' | 'upload' | 'extractions' | 'hearted';
type LibraryLayout = 'compact' | 'grid';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'has_extractions';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'has_extractions', label: 'Has Extractions' },
];

export default function Manifest() {
  usePageContext({ page: 'manifest' });
  const { user } = useAuthContext();
  const {
    items,
    loading,
    fetchItems,
    uploadFile,
    createTextNote,
    updateItem,
    reprocessItem,
    archiveItem,
    deleteItem,
    pollProcessingStatus,
    getUniqueTags,
    fetchItemDetail,
    checkDuplicate,
    enrichItem,
    autoIntakeItem,
  } = useManifest();

  const {
    saveFramework,
    getFrameworkForItem,
    fetchFrameworks,
  } = useFrameworks();

  const extraction = useManifestExtraction();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [libraryLayout, setLibraryLayout] = useState<LibraryLayout>('compact');
  const [selectedItem, setSelectedItem] = useState<ManifestItem | null>(null);
  const [showTextNoteModal, setShowTextNoteModal] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

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

  // Filters & sort
  const [typeFilter, setTypeFilter] = useState<ManifestFileType | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<ManifestUsageDesignation | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  useEffect(() => {
    fetchItems();
    fetchFrameworks();
    fetchDiscussions();
  }, [fetchItems, fetchFrameworks, fetchDiscussions]);

  // Poll for processing items
  useEffect(() => {
    const processingItems = items.filter(
      (i) => i.processing_status === 'pending' || i.processing_status === 'processing',
    );
    processingItems.forEach((item) => {
      pollProcessingStatus(item.id);
    });
  }, [items, pollProcessingStatus]);

  const handleSelectItem = useCallback(async (item: ManifestItem) => {
    const detail = await fetchItemDetail(item.id);
    setSelectedItem(detail || item);
    setViewMode('detail');
  }, [fetchItemDetail]);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setViewMode('list');
    fetchItems();
  }, [fetchItems]);


  const handleUpload = useCallback(async (file: File) => {
    const item = await uploadFile(file);
    if (item) {
      pollProcessingStatus(item.id);
    }
    return item;
  }, [uploadFile, pollProcessingStatus]);

  const handleTextNote = useCallback(async (title: string, content: string) => {
    const item = await createTextNote(title, content);
    if (item) {
      pollProcessingStatus(item.id);
      autoIntakeItem(item.id).catch((err) =>
        console.error('Text note auto-intake failed:', err),
      );
    }
    return item;
  }, [createTextNote, pollProcessingStatus, autoIntakeItem]);

  const handleDiscussBooks = useCallback(() => {
    setFabExpanded(false);
    setShowBookSelector(true);
  }, []);

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
    const success = await extraction.extractAll(selectedItem.id, genres, async (result) => {
      // Save framework result through useFrameworks
      if (result && result.framework_name && result.principles?.length > 0) {
        await saveFramework(
          selectedItem.id,
          result.framework_name,
          result.principles.map((p: { text: string; sort_order: number }) => ({
            text: p.text,
            sort_order: p.sort_order,
          })),
          true,
        );
        fetchFrameworks();
      }
    });
    await refreshAfterExtraction(selectedItem.id);
    return success;
  }, [selectedItem, extraction, saveFramework, fetchFrameworks, refreshAfterExtraction]);

  const handleDiscoverSections = useCallback(async () => {
    if (!selectedItem) return [];
    return extraction.discoverSections(selectedItem.id);
  }, [selectedItem, extraction]);

  const handleExtractAllSections = useCallback(async (genres: BookGenre[], sectionIndices: number[]): Promise<boolean> => {
    if (!selectedItem) return false;
    let principleOffset = 0;
    let isFirstSection = true;

    const success = await extraction.extractAllSections(selectedItem.id, genres, sectionIndices, async (result, sectionTitle, _sectionIndex) => {
      // Save framework results progressively per-section so they appear in the UI immediately
      if (result && result.framework_name && result.principles?.length > 0) {
        console.log(`[handleExtractAllSections] Saving ${result.principles.length} principles from section "${sectionTitle}"`);
        const principles = result.principles.map((p: { text: string; sort_order: number }, idx: number) => ({
          text: p.text,
          sort_order: principleOffset + idx,
          section_title: sectionTitle,
        }));
        principleOffset += principles.length;
        // First section: replace existing principles (append=false). Subsequent: append.
        const shouldAppend = !isFirstSection;
        isFirstSection = false;
        await saveFramework(selectedItem.id, result.framework_name, principles, true, shouldAppend);
      }
    });

    fetchFrameworks();
    await refreshAfterExtraction(selectedItem.id);
    return success;
  }, [selectedItem, extraction, saveFramework, fetchFrameworks, refreshAfterExtraction]);

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
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.file_type !== typeFilter) return false;
      if (usageFilter !== 'all' && !item.usage_designations.includes(usageFilter)) return false;
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [items, typeFilter, usageFilter, tagFilter]);

  const hasCompletedItems = items.some((i) => i.processing_status === 'completed');
  const hasExtractedItems = items.some((i) => i.extraction_status === 'completed');
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
          const aExtracted = a.extraction_status === 'completed' ? 0 : 1;
          const bExtracted = b.extraction_status === 'completed' ? 0 : 1;
          if (aExtracted !== bExtracted) return aExtracted - bExtracted;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [filteredItems, sortOption]);

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

  const uniqueTags = useMemo(() => getUniqueTags(), [getUniqueTags]);

  // Keep selectedItem in sync with items array
  const currentSelectedItem = useMemo(
    () => (selectedItem ? items.find((i) => i.id === selectedItem.id) || selectedItem : null),
    [items, selectedItem],
  );

  // Get framework principles for current item
  const currentFramework = currentSelectedItem ? getFrameworkForItem(currentSelectedItem.id) : undefined;
  const currentPrinciples: import('../lib/types').AIFrameworkPrinciple[] = currentFramework?.principles || [];

  // Upload view
  if (viewMode === 'upload') {
    return (
      <div className="page manifest-page">
        <UploadFlow
          onUpload={handleUpload}
          onCheckDuplicate={checkDuplicate}
          onAutoIntake={autoIntakeItem}
          onClose={handleBack}
        />
      </div>
    );
  }

  // Extractions view
  if (viewMode === 'extractions') {
    return (
      <div className="page manifest-page">
        <ExtractionsView items={items} onBack={handleBack} />
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

  // Hearted items view
  if (viewMode === 'hearted') {
    return (
      <div className="page manifest-page">
        <HeartedItemsView onBack={handleBack} />
        {/* Modals rendered outside conditional */}
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

  // Detail view
  if (viewMode === 'detail' && currentSelectedItem) {
    return (
      <div className="page manifest-page">
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
          // Section discovery props
          onDiscoverSections={handleDiscoverSections}
          onExtractAllSections={handleExtractAllSections}
          sections={extraction.sections}
          selectedSectionIndices={extraction.selectedSectionIndices}
          onSetSelectedSectionIndices={extraction.setSelectedSectionIndices}
          discoveringSections={extraction.discoveringSections}
          extractionProgress={extraction.extractionProgress}
          onClearExtractions={async (itemId: string) => {
            await extraction.clearExtractions(itemId);
            fetchFrameworks();
          }}
          // Discussion
          onOpenDiscussion={handleOpenDiscussionFromDetail}
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
            <div className="manifest-page__layout-toggle">
              <button
                type="button"
                className={`manifest-page__layout-btn${libraryLayout === 'compact' ? ' manifest-page__layout-btn--active' : ''}`}
                onClick={() => setLibraryLayout('compact')}
                title="List view"
              >
                <List size={18} />
              </button>
              <button
                type="button"
                className={`manifest-page__layout-btn${libraryLayout === 'grid' ? ' manifest-page__layout-btn--active' : ''}`}
                onClick={() => setLibraryLayout('grid')}
                title="Card view"
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.manifest} />

      {/* Action buttons */}
      <div className="manifest-page__actions">
        <button
          type="button"
          className="manifest-page__action-btn manifest-page__action-btn--primary"
          onClick={() => setViewMode('upload')}
        >
          <Upload size={16} />
          Upload Files
        </button>
        <button
          type="button"
          className="manifest-page__action-btn"
          onClick={() => setShowTextNoteModal(true)}
        >
          <StickyNote size={16} />
          Add Note
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
            onClick={() => setViewMode('hearted')}
          >
            <Heart size={16} />
            My Hearted Items
          </button>
        )}
        {hasExtractedItems && (
          <button
            type="button"
            className="manifest-page__action-btn"
            onClick={() => setViewMode('extractions')}
          >
            <Layers size={16} />
            Extractions
          </button>
        )}
        {hasExtractedItems && (
          <button
            type="button"
            className="manifest-page__action-btn manifest-page__action-btn--danger"
            onClick={() => setShowFreshStart(true)}
          >
            <Trash2 size={16} />
            Fresh Start
          </button>
        )}
      </div>

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
          <ManifestFilterBar
            typeFilter={typeFilter}
            usageFilter={usageFilter}
            tagFilter={tagFilter}
            uniqueTags={uniqueTags}
            onTypeChange={setTypeFilter}
            onUsageChange={setUsageFilter}
            onTagChange={setTagFilter}
          />
          <div className="manifest-page__sort-bar">
            <span className="manifest-page__sort-label">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`manifest-page__sort-btn${sortOption === opt.value ? ' manifest-page__sort-btn--active' : ''}`}
                onClick={() => setSortOption(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      {(
        loading && items.length === 0 ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <EmptyState
            heading="Your library is empty"
            message="Upload books, articles, notes, and transcripts. The AI draws from your library to give you advice grounded in the wisdom you trust."
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            heading="No matching items"
            message="Try adjusting your filters to see more items."
          />
        ) : libraryLayout === 'compact' ? (
          <div className="manifest-page__compact-list">
            {sortedItems.map((item) => (
              <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} compact />
            ))}
          </div>
        ) : folderGroups.length === 1 ? (
          <div className="manifest-page__item-list">
            {folderGroups[0][1].map((item) => (
              <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} />
            ))}
          </div>
        ) : (
          folderGroups.map(([folder, folderItems]) => (
            <CollapsibleGroup
              key={folder}
              label={folder}
              count={folderItems.length}
              defaultExpanded
            >
              <div className="manifest-page__item-list">
                {folderItems.map((item) => (
                  <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} />
                ))}
              </div>
            </CollapsibleGroup>
          ))
        )
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
            <button
              type="button"
              className="manifest-page__fab-option"
              onClick={() => { setFabExpanded(false); setShowTextNoteModal(true); }}
            >
              Add Text Note
            </button>
          </div>
        )}
        <FloatingActionButton onClick={() => setFabExpanded(!fabExpanded)}>
          {fabExpanded ? 'Close' : '+'}
        </FloatingActionButton>
      </div>

      {/* Text Note Modal */}
      {showTextNoteModal && (
        <TextNoteModal
          onSave={handleTextNote}
          onClose={() => setShowTextNoteModal(false)}
        />
      )}

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
    </div>
  );
}
