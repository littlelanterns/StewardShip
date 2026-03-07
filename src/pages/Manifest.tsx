import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, StickyNote, MessageSquare, Loader, BookOpen, List, LayoutGrid } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useManifest } from '../hooks/useManifest';
import { useFrameworks } from '../hooks/useFrameworks';
import { useManifestExtraction } from '../hooks/useManifestExtraction';
import type { ManifestItem, ManifestFileType, ManifestUsageDesignation, BookGenre } from '../lib/types';
import { ManifestItemCard } from '../components/manifest/ManifestItemCard';
import { ManifestItemDetail } from '../components/manifest/ManifestItemDetail';
import { ManifestFilterBar } from '../components/manifest/ManifestFilterBar';
import { UploadFlow } from '../components/manifest/UploadFlow';
import { TextNoteModal } from '../components/manifest/TextNoteModal';
import FrameworkPrinciples from '../components/manifest/FrameworkPrinciples';
import FrameworkManager from '../components/manifest/FrameworkManager';
import BrowseFrameworks from '../components/manifest/BrowseFrameworks';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { EmptyState, LoadingSpinner, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Manifest.css';

type ViewMode = 'list' | 'detail' | 'upload' | 'framework' | 'frameworks' | 'browse';
type LibraryLayout = 'compact' | 'grid';

export default function Manifest() {
  usePageContext({ page: 'manifest' });
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
    frameworks,
    extracting: frameworkExtracting,
    extractFramework,
    saveFramework,
    toggleFramework,
    batchToggleFrameworks,
    getFrameworkForItem,
    fetchFrameworks,
    checkDocumentLength,
    discoverSections,
    extractFromSection,
    tagFramework,
    updateFrameworkTags,
  } = useFrameworks();

  const extraction = useManifestExtraction();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [libraryLayout, setLibraryLayout] = useState<LibraryLayout>('compact');
  const [selectedItem, setSelectedItem] = useState<ManifestItem | null>(null);
  const [showTextNoteModal, setShowTextNoteModal] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<ManifestFileType | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<ManifestUsageDesignation | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
    fetchFrameworks();
  }, [fetchItems, fetchFrameworks]);

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

  const handleBackToDetail = useCallback(() => {
    setViewMode('detail');
  }, []);

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

  const handleAskLibrary = useCallback(() => {
    setFabExpanded(false);
    // TODO: Phase D will replace this with BookDiscussionModal
    // For now, keep the old manifest_discuss guided mode as a fallback
  }, []);

  const handleBrowseFrameworks = useCallback(() => {
    setViewMode('browse');
  }, []);

  const handleViewFramework = useCallback(async (itemId: string) => {
    const detail = await fetchItemDetail(itemId);
    const item = detail || items.find((i) => i.id === itemId);
    if (item) {
      setSelectedItem(item);
      setViewMode('framework');
    }
  }, [fetchItemDetail, items]);

  const handleSelectFrameworkForEdit = useCallback(async (fw: { manifest_item_id: string }) => {
    await handleViewFramework(fw.manifest_item_id);
  }, [handleViewFramework]);

  // --- Extraction handlers (wired to useManifestExtraction) ---

  const handleExtractAll = useCallback(async (genres: BookGenre[]): Promise<boolean> => {
    if (!selectedItem) return false;
    return extraction.extractAll(selectedItem.id, genres, async (result) => {
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
  }, [selectedItem, extraction, saveFramework, fetchFrameworks]);

  const handleDiscoverSections = useCallback(async () => {
    if (!selectedItem) return [];
    return extraction.discoverSections(selectedItem.id);
  }, [selectedItem, extraction]);

  const handleExtractAllSections = useCallback(async (genres: BookGenre[], sectionIndices: number[]): Promise<boolean> => {
    if (!selectedItem) return false;
    let principleOffset = 0;

    const success = await extraction.extractAllSections(selectedItem.id, genres, sectionIndices, async (result, sectionTitle, _sectionIndex) => {
      // Save framework results progressively per-section so they appear in the UI immediately
      if (result && result.framework_name && result.principles?.length > 0) {
        console.log(`[handleExtractAllSections] Saving ${result.principles.length} principles from section "${sectionTitle}"`);
        const principles = result.principles.map((p: { text: string; sort_order: number }, idx: number) => ({
          text: p.text,
          sort_order: principleOffset + idx,
        }));
        principleOffset += principles.length;
        // append = true so each section's principles add to the existing framework
        await saveFramework(selectedItem.id, result.framework_name, principles, true);
      }
    });

    fetchFrameworks();
    return success;
  }, [selectedItem, extraction, saveFramework, fetchFrameworks]);

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

  const handleViewFrameworkFromDetail = useCallback(() => {
    if (selectedItem) {
      setViewMode('framework');
    }
  }, [selectedItem]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.file_type !== typeFilter) return false;
      if (usageFilter !== 'all' && !item.usage_designations.includes(usageFilter)) return false;
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [items, typeFilter, usageFilter, tagFilter]);

  // Group by folder
  const folderGroups = useMemo(() => {
    const groups: Record<string, ManifestItem[]> = {};
    for (const item of filteredItems) {
      const folder = item.folder_group || 'Uncategorized';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const uniqueTags = useMemo(() => getUniqueTags(), [getUniqueTags]);

  // Keep selectedItem in sync with items array
  const currentSelectedItem = useMemo(
    () => (selectedItem ? items.find((i) => i.id === selectedItem.id) || selectedItem : null),
    [items, selectedItem],
  );

  const hasCompletedItems = items.some((i) => i.processing_status === 'completed');
  const processingItems = items.filter(
    (i) => i.processing_status === 'pending' || i.processing_status === 'processing',
  );
  const hasProcessingItems = processingItems.length > 0;

  // Sort items: processing first, then by date newest first
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aProcessing = a.processing_status === 'pending' || a.processing_status === 'processing';
      const bProcessing = b.processing_status === 'pending' || b.processing_status === 'processing';
      if (aProcessing && !bProcessing) return -1;
      if (!aProcessing && bProcessing) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredItems]);

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

  // Framework extraction view
  if (viewMode === 'framework' && currentSelectedItem) {
    return (
      <div className="page manifest-page">
        <FrameworkPrinciples
          manifestItemId={currentSelectedItem.id}
          manifestItemTitle={currentSelectedItem.title}
          framework={getFrameworkForItem(currentSelectedItem.id)}
          extracting={frameworkExtracting}
          onExtract={extractFramework}
          onCheckDocumentLength={checkDocumentLength}
          onDiscoverSections={discoverSections}
          onExtractSection={extractFromSection}
          onSave={saveFramework}
          onToggle={toggleFramework}
          onUpdateTags={updateFrameworkTags}
          onBack={handleBackToDetail}
        />
      </div>
    );
  }

  // Browse frameworks view
  if (viewMode === 'browse') {
    return (
      <div className="page manifest-page">
        <BrowseFrameworks
          frameworks={frameworks}
          items={items}
          onSelectFramework={handleSelectFrameworkForEdit}
          onBack={() => setViewMode('frameworks')}
        />
      </div>
    );
  }

  // Frameworks manager view
  if (viewMode === 'frameworks') {
    return (
      <div className="page manifest-page">
        <FrameworkManager
          frameworks={frameworks}
          items={items}
          onToggleFrameworks={batchToggleFrameworks}
          onSelectFramework={handleSelectFrameworkForEdit}
          onBrowse={handleBrowseFrameworks}
          onTagFramework={tagFramework}
          onBack={handleBack}
        />
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
          principles={currentPrinciples}
          extracting={extraction.extracting}
          extractingTab={extraction.extractingTab}
          hasFramework={!!currentFramework}
          onExtractAll={handleExtractAll}
          onUpdateGenres={extraction.updateGenres}
          onFetchSummaries={extraction.fetchSummaries}
          onFetchDeclarations={extraction.fetchDeclarations}
          // Summary actions
          onToggleSummaryHeart={extraction.toggleSummaryHeart}
          onDeleteSummary={extraction.deleteSummary}
          onUpdateSummaryText={extraction.updateSummaryText}
          onSummaryGoDeeper={handleSummaryGoDeeper}
          onSummaryReRun={handleSummaryReRun}
          // Framework actions
          onTogglePrincipleHeart={extraction.togglePrincipleHeart}
          onDeletePrinciple={extraction.deletePrinciple}
          onViewFramework={handleViewFrameworkFromDetail}
          // Declaration actions
          onToggleDeclarationHeart={extraction.toggleDeclarationHeart}
          onDeleteDeclaration={extraction.deleteDeclaration}
          onUpdateDeclaration={extraction.updateDeclaration}
          onSendDeclarationToMast={extraction.sendDeclarationToMast}
          onDeclarationGoDeeper={handleDeclarationGoDeeper}
          onDeclarationReRun={handleDeclarationReRun}
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
        />
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
            onClick={handleAskLibrary}
            disabled
            title="Coming soon — Book Discussions will replace this"
          >
            <MessageSquare size={16} />
            Discuss Books
          </button>
        )}
        {frameworks.length > 0 && (
          <button
            type="button"
            className="manifest-page__action-btn"
            onClick={() => setViewMode('frameworks')}
          >
            <BookOpen size={16} />
            Frameworks ({frameworks.length})
          </button>
        )}
      </div>

      {/* Processing indicator */}
      {hasProcessingItems && (
        <div className="manifest-page__processing">
          <Loader size={14} className="manifest-page__processing-spin" />
          <span>Processing {processingItems.length} item{processingItems.length !== 1 ? 's' : ''}...</span>
        </div>
      )}

      {/* Filter bar */}
      {items.length > 0 && (
        <ManifestFilterBar
          typeFilter={typeFilter}
          usageFilter={usageFilter}
          tagFilter={tagFilter}
          uniqueTags={uniqueTags}
          onTypeChange={setTypeFilter}
          onUsageChange={setUsageFilter}
          onTagChange={setTagFilter}
        />
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
              <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} framework={getFrameworkForItem(item.id)} compact />
            ))}
          </div>
        ) : folderGroups.length === 1 ? (
          <div className="manifest-page__item-list">
            {folderGroups[0][1].map((item) => (
              <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} framework={getFrameworkForItem(item.id)} />
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
                  <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} framework={getFrameworkForItem(item.id)} />
                ))}
              </div>
            </CollapsibleGroup>
          ))
        )
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
    </div>
  );
}
