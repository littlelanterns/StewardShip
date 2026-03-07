import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, StickyNote, MessageSquare, Loader, BookOpen, List, LayoutGrid } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useManifest } from '../hooks/useManifest';
import { useFrameworks } from '../hooks/useFrameworks';
import { useMast } from '../hooks/useMast';
import { useHelmContext } from '../contexts/HelmContext';
import type { ManifestItem, ManifestFileType, ManifestUsageDesignation, MastEntryType } from '../lib/types';
import { ManifestItemCard } from '../components/manifest/ManifestItemCard';
import { ManifestItemDetail } from '../components/manifest/ManifestItemDetail';
import { ManifestFilterBar } from '../components/manifest/ManifestFilterBar';
import { UploadFlow } from '../components/manifest/UploadFlow';
import { TextNoteModal } from '../components/manifest/TextNoteModal';
import FrameworkPrinciples from '../components/manifest/FrameworkPrinciples';
import FrameworkManager from '../components/manifest/FrameworkManager';
import BrowseFrameworks from '../components/manifest/BrowseFrameworks';
import MastExtractionReview from '../components/manifest/MastExtractionReview';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { EmptyState, LoadingSpinner, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Manifest.css';

type ViewMode = 'list' | 'detail' | 'upload' | 'framework' | 'frameworks' | 'browse' | 'mast_extract';
type LibraryLayout = 'compact' | 'grid';

export default function Manifest() {
  usePageContext({ page: 'manifest' });
  const { startGuidedConversation } = useHelmContext();
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
    extracting,
    extractFramework,
    extractMast,
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

  const mast = useMast();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [libraryLayout, setLibraryLayout] = useState<LibraryLayout>('compact');
  const [selectedItem, setSelectedItem] = useState<ManifestItem | null>(null);
  const [showTextNoteModal, setShowTextNoteModal] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Extraction state
  const [mastExtractionResults, setMastExtractionResults] = useState<Array<{ text: string; entry_type: string }> | null>(null);

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
    setMastExtractionResults(null);
    setViewMode('list');
    fetchItems();
  }, [fetchItems]);

  const handleBackToDetail = useCallback(() => {
    setMastExtractionResults(null);
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
      // Auto-intake in background (fire-and-forget)
      autoIntakeItem(item.id).catch((err) =>
        console.error('Text note auto-intake failed:', err),
      );
    }
    return item;
  }, [createTextNote, pollProcessingStatus, autoIntakeItem]);

  const handleAskLibrary = useCallback(() => {
    setFabExpanded(false);
    startGuidedConversation('manifest_discuss');
  }, [startGuidedConversation]);

  const handleBrowseFrameworks = useCallback(() => {
    setViewMode('browse');
  }, []);

  // Navigate to a framework view for a specific item (from frameworks manager)
  const handleViewFramework = useCallback(async (itemId: string) => {
    const detail = await fetchItemDetail(itemId);
    const item = detail || items.find((i) => i.id === itemId);
    if (item) {
      setSelectedItem(item);
      setViewMode('framework');
    }
  }, [fetchItemDetail, items]);

  // Navigate from FrameworkManager card click to principles editor
  const handleSelectFrameworkForEdit = useCallback(async (fw: { manifest_item_id: string }) => {
    await handleViewFramework(fw.manifest_item_id);
  }, [handleViewFramework]);

  // Extraction handlers
  const handleExtractFramework = useCallback(() => {
    if (selectedItem) {
      setViewMode('framework');
    }
  }, [selectedItem]);

  const handleExtractMast = useCallback(async () => {
    if (!selectedItem) return;
    setViewMode('mast_extract');
    const results = await extractMast(selectedItem.id);
    setMastExtractionResults(results);
  }, [selectedItem, extractMast]);

  const handleSaveMastEntries = useCallback(async (
    entries: Array<{ type: MastEntryType; text: string; source: 'manifest_extraction' }>,
  ) => {
    for (const entry of entries) {
      await mast.createEntry({
        type: entry.type,
        text: entry.text,
        source: 'manifest_extraction',
      });
    }
    handleBackToDetail();
  }, [mast, handleBackToDetail]);

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

  // Keep selectedItem in sync with items array (so updates via updateItem are reflected)
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
          extracting={extracting}
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

  // Mast extraction review
  if (viewMode === 'mast_extract' && currentSelectedItem) {
    return (
      <div className="page manifest-page">
        <MastExtractionReview
          sourceTitle={currentSelectedItem.title}
          entries={mastExtractionResults}
          extracting={extracting}
          onSave={handleSaveMastEntries}
          onCancel={handleBackToDetail}
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
          onExtractFramework={handleExtractFramework}
          onExtractMast={handleExtractMast}
          onEnrichItem={enrichItem}
          hasFramework={!!getFrameworkForItem(currentSelectedItem.id)}
          frameworkIsActive={getFrameworkForItem(currentSelectedItem.id)?.is_active ?? false}
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
          >
            <MessageSquare size={16} />
            Ask Your Library
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
          /* Compact list view — flat, dense rows */
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
